use actix_web::{web, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use crate::services::analytics::{AnalyticsService, GlobalAnalytics, ParticipantAnalytics};

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub limit: Option<usize>,
    pub metric_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsResponse {
    pub status: String,
    pub data: serde_json::Value,
}

pub async fn get_participant_analytics(
    participant_id: web::Path<String>,
    _service: web::Data<AnalyticsService>,
) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(AnalyticsResponse {
        status: "success".to_string(),
        data: serde_json::json!({"message": "Participant analytics endpoint"}),
    }))
}

pub async fn get_global_analytics(
    _query: web::Query<AnalyticsQuery>,
    _service: web::Data<AnalyticsService>,
) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(AnalyticsResponse {
        status: "success".to_string(),
        data: serde_json::json!({"message": "Global analytics endpoint"}),
    }))
}

pub async fn get_metrics_history(
    metric_name: web::Path<String>,
    query: web::Query<AnalyticsQuery>,
    _service: web::Data<AnalyticsService>,
) -> Result<HttpResponse> {
    let limit = query.limit.unwrap_or(100);
    Ok(HttpResponse::Ok().json(AnalyticsResponse {
        status: "success".to_string(),
        data: serde_json::json!({"metric": metric_name.into_inner(), "limit": limit}),
    }))
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/analytics")
            .route("/participant/{id}", web::get().to(get_participant_analytics))
            .route("/global", web::get().to(get_global_analytics))
            .route("/metrics/{name}", web::get().to(get_metrics_history)),
    );
}
