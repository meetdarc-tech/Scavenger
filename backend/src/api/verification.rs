use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::collections::HashMap;
use crate::services::VerificationService;

#[derive(Deserialize)]
pub struct StartVerificationRequest {
    pub participant_id: String,
}

#[derive(Deserialize)]
pub struct DocumentUploadRequest {
    pub participant_id: String,
    pub doc_type: String,
    pub url: String,
}

#[derive(Deserialize)]
pub struct ChecklistSubmitRequest {
    pub participant_id: String,
    pub checks: HashMap<String, bool>,
}

#[derive(Deserialize)]
pub struct ApprovalRequest {
    pub participant_id: String,
    pub reviewer_id: String,
}

#[derive(Deserialize)]
pub struct RejectionRequest {
    pub participant_id: String,
    pub reason: String,
    pub reviewer_id: String,
}

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

pub async fn start_verification(
    req: web::Json<StartVerificationRequest>,
    service: web::Data<Arc<dyn VerificationService>>,
) -> HttpResponse {
    match service.start_verification(req.participant_id.clone()).await {
        Ok(verification) => HttpResponse::Ok().json(ApiResponse::success(verification)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<String>::error(e)),
    }
}

pub async fn submit_document(
    req: web::Json<DocumentUploadRequest>,
    service: web::Data<Arc<dyn VerificationService>>,
) -> HttpResponse {
    match service
        .submit_document(
            req.participant_id.clone(),
            req.doc_type.clone(),
            req.url.clone(),
        )
        .await
    {
        Ok(document) => HttpResponse::Ok().json(ApiResponse::success(document)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<String>::error(e)),
    }
}

pub async fn verify_document(
    doc_id: web::Path<String>,
    service: web::Data<Arc<dyn VerificationService>>,
) -> HttpResponse {
    match service.verify_document(doc_id.into_inner()).await {
        Ok(document) => HttpResponse::Ok().json(ApiResponse::success(document)),
        Err(e) => HttpResponse::NotFound().json(ApiResponse::<String>::error(e)),
    }
}

pub async fn get_verification_status(
    participant_id: web::Path<String>,
    service: web::Data<Arc<dyn VerificationService>>,
) -> HttpResponse {
    match service.get_verification_status(participant_id.into_inner()).await {
        Ok(verification) => HttpResponse::Ok().json(ApiResponse::success(verification)),
        Err(e) => HttpResponse::NotFound().json(ApiResponse::<String>::error(e)),
    }
}

pub async fn submit_checklist(
    req: web::Json<ChecklistSubmitRequest>,
    service: web::Data<Arc<dyn VerificationService>>,
) -> HttpResponse {
    match service
        .submit_checklist(req.participant_id.clone(), req.checks.clone())
        .await
    {
        Ok(checklist) => HttpResponse::Ok().json(ApiResponse::success(checklist)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<String>::error(e)),
    }
}

pub async fn get_pending_reviews(
    service: web::Data<Arc<dyn VerificationService>>,
) -> HttpResponse {
    match service.get_pending_reviews().await {
        Ok(reviews) => HttpResponse::Ok().json(ApiResponse::success(reviews)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(e)),
    }
}

pub async fn approve_participant(
    req: web::Json<ApprovalRequest>,
    service: web::Data<Arc<dyn VerificationService>>,
) -> HttpResponse {
    match service
        .approve_participant(req.participant_id.clone(), req.reviewer_id.clone())
        .await
    {
        Ok(_) => {
            let _ = service.send_approval_notification(req.participant_id.clone()).await;
            HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"status": "approved"})))
        }
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<String>::error(e)),
    }
}

pub async fn reject_participant(
    req: web::Json<RejectionRequest>,
    service: web::Data<Arc<dyn VerificationService>>,
) -> HttpResponse {
    match service
        .reject_participant(
            req.participant_id.clone(),
            req.reason.clone(),
            req.reviewer_id.clone(),
        )
        .await
    {
        Ok(_) => {
            let _ = service
                .send_rejection_notification(req.participant_id.clone(), req.reason.clone())
                .await;
            HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"status": "rejected"})))
        }
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<String>::error(e)),
    }
}

pub async fn retry_verification(
    participant_id: web::Path<String>,
    service: web::Data<Arc<dyn VerificationService>>,
) -> HttpResponse {
    match service.retry_verification(participant_id.into_inner()).await {
        Ok(verification) => HttpResponse::Ok().json(ApiResponse::success(verification)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<String>::error(e)),
    }
}
