terraform {
  backend "s3" {
    # Override at runtime with -backend-config=backend.hcl
    bucket         = "tfstate-590183661886-<REGION>"
    key            = "resources/<ENVIRONMENT>/bball-app-user-service.tfstate"
    region         = "<REGION>"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
