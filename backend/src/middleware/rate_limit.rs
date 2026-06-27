use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use futures::future::LocalBoxFuture;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Rate limiting tier — determines request quotas.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum RateLimitTier {
    Anonymous,
    Free,
    Premium,
    Admin,
}

impl RateLimitTier {
    pub fn config(&self) -> RateLimitConfig {
        match self {
            RateLimitTier::Anonymous => RateLimitConfig { requests_per_minute: 30, requests_per_hour: 200 },
            RateLimitTier::Free      => RateLimitConfig { requests_per_minute: 60, requests_per_hour: 1000 },
            RateLimitTier::Premium   => RateLimitConfig { requests_per_minute: 300, requests_per_hour: 5000 },
            RateLimitTier::Admin     => RateLimitConfig { requests_per_minute: 1000, requests_per_hour: 50000 },
        }
    }
}

#[derive(Clone)]
pub struct RateLimitConfig {
    pub requests_per_minute: u32,
    pub requests_per_hour: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        RateLimitTier::Free.config()
    }
}

/// Atomic counters for observability.
#[derive(Debug, Default, Clone)]
pub struct RateLimitMetrics {
    pub total_requests: u64,
    pub rate_limited_requests: u64,
    pub by_tier: HashMap<String, u64>,
}

struct RateLimitState {
    minute_buckets: HashMap<String, Vec<Instant>>,
    hour_buckets: HashMap<String, Vec<Instant>>,
    metrics: RateLimitMetrics,
}

pub struct RateLimitMiddleware {
    config: RateLimitConfig,
    state: Arc<Mutex<RateLimitState>>,
}

impl RateLimitMiddleware {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            config,
            state: Arc::new(Mutex::new(RateLimitState {
                minute_buckets: HashMap::new(),
                hour_buckets: HashMap::new(),
                metrics: RateLimitMetrics::default(),
            })),
        }
    }

    pub fn metrics(&self) -> RateLimitMetrics {
        self.state.lock().unwrap().metrics.clone()
    }
}

impl<S, B> Transform<S, ServiceRequest> for RateLimitMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = RateLimitMiddlewareService<S>;
    type Future = std::future::Ready<Result<Self::Transform, Self::InitError>>;

    fn new_service(&self, service: S) -> Self::Future {
        std::future::ready(Ok(RateLimitMiddlewareService {
            service,
            config: self.config.clone(),
            state: self.state.clone(),
        }))
    }
}

pub struct RateLimitMiddlewareService<S> {
    service: S,
    config: RateLimitConfig,
    state: Arc<Mutex<RateLimitState>>,
}

impl<S, B> Service<ServiceRequest> for RateLimitMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let client_ip = req
            .connection_info()
            .peer_addr()
            .unwrap_or("unknown")
            .to_string();

        let config = self.config.clone();
        let state = self.state.clone();

        let mut s = state.lock().unwrap();
        s.metrics.total_requests += 1;
        let now = Instant::now();

        // Sliding window — minute
        let minute_key = format!("{}:minute", client_ip);
        let min_reqs = s.minute_buckets.entry(minute_key).or_default();
        min_reqs.retain(|t| now.duration_since(*t) < Duration::from_secs(60));
        let min_count = min_reqs.len();

        if min_count >= config.requests_per_minute as usize {
            s.metrics.rate_limited_requests += 1;
            drop(s);
            return Box::pin(async move {
                Err(actix_web::error::ErrorTooManyRequests(
                    "Rate limit exceeded: too many requests per minute",
                ))
            });
        }

        // Sliding window — hour
        let hour_key = format!("{}:hour", client_ip);
        let hr_reqs = s.hour_buckets.entry(hour_key).or_default();
        hr_reqs.retain(|t| now.duration_since(*t) < Duration::from_secs(3600));
        let hr_count = hr_reqs.len();

        if hr_count >= config.requests_per_hour as usize {
            s.metrics.rate_limited_requests += 1;
            drop(s);
            return Box::pin(async move {
                Err(actix_web::error::ErrorTooManyRequests(
                    "Rate limit exceeded: too many requests per hour",
                ))
            });
        }

        // Record this request
        let min_key2 = format!("{}:minute", client_ip);
        s.minute_buckets.entry(min_key2).or_default().push(now);
        let hr_key2 = format!("{}:hour", client_ip);
        s.hour_buckets.entry(hr_key2).or_default().push(now);
        let remaining_min = config.requests_per_minute as usize - min_count - 1;
        let remaining_hr  = config.requests_per_hour  as usize - hr_count  - 1;
        drop(s);

        let rpm = config.requests_per_minute.to_string();
        let rph = config.requests_per_hour.to_string();

        let service = self.service.clone();
        Box::pin(async move {
            let res = service.call(req).await?;
            let mut response = res;
            let h = response.headers_mut();
            use actix_web::http::header::{HeaderName, HeaderValue};
            let insert = |h: &mut actix_web::http::header::HeaderMap, k: &'static str, v: String| {
                if let (Ok(name), Ok(val)) = (HeaderName::from_static(k), HeaderValue::from_str(&v)) {
                    h.insert(name, val);
                }
            };
            insert(h, "x-ratelimit-limit-minute", rpm);
            insert(h, "x-ratelimit-limit-hour", rph);
            insert(h, "x-ratelimit-remaining-minute", remaining_min.to_string());
            insert(h, "x-ratelimit-remaining-hour",   remaining_hr.to_string());
            Ok(response)
        })
    }
}
