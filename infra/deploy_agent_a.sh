#!/bin/bash
set -e

# 環境変数の読み込み
source ../.env.local || { echo "Error: .env.local file not found"; exit 1; }

# PROJECT_ID が設定されているか確認
if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID is not set in .env.local"
    exit 1
fi

# サービス名の設定
SERVICE_NAME="agent-a"
REGION="asia-northeast1"

echo "=== AutoSpec Generator: Agent-A デプロイ ==="
echo "Project ID: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"

# Dockerイメージをビルドしてpush
echo "=== イメージのビルドとプッシュ ==="
IMAGE_URL="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"
cd ../agents/agent-a
gcloud builds submit --tag $IMAGE_URL .
echo "Image pushed to: $IMAGE_URL"

# Secretsの確認/作成
echo "=== Secretsの確認/作成 ==="
SECRETS=("OPENAI_API_KEY" "SUPABASE_URL" "SUPABASE_SERVICE_KEY")

for SECRET in "${SECRETS[@]}"; do
    # 環境変数が設定されているか確認
    if [ -z "${!SECRET}" ]; then
        echo "Error: $SECRET is not set in .env.local"
        exit 1
    fi

    # Secretが存在するか確認
    if ! gcloud secrets describe $SECRET &>/dev/null; then
        echo "Creating secret: $SECRET"
        echo -n "${!SECRET}" | gcloud secrets create $SECRET --replication-policy="automatic" --data-file=-
    else
        echo "Secret exists: $SECRET. Updating..."
        echo -n "${!SECRET}" | gcloud secrets versions add $SECRET --data-file=-
    fi
done

# Cloud Runサービスのデプロイ
echo "=== Cloud Runサービスのデプロイ ==="
SECRET_ARGS=""
for SECRET in "${SECRETS[@]}"; do
    SECRET_ARGS="$SECRET_ARGS --set-secrets $SECRET=projects/$PROJECT_ID/secrets/$SECRET:latest"
done

gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_URL \
    --platform managed \
    --region $REGION \
    $SECRET_ARGS \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --concurrency 80

# Pub/Subトピック & サブスクリプションの作成
echo "=== Pub/Subトピックの作成 ==="
TOPIC_NAME="doc-generation-topic"
if ! gcloud pubsub topics describe $TOPIC_NAME &>/dev/null; then
    gcloud pubsub topics create $TOPIC_NAME
    echo "Topic created: $TOPIC_NAME"
else
    echo "Topic already exists: $TOPIC_NAME"
fi

# サービスURLの取得
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")
echo "Service URL: $SERVICE_URL"

echo "=== Pub/Subサブスクリプションの作成 ==="
SUB_NAME="agent-a-sub"
if ! gcloud pubsub subscriptions describe $SUB_NAME &>/dev/null; then
    gcloud pubsub subscriptions create $SUB_NAME \
        --topic=$TOPIC_NAME \
        --push-endpoint="$SERVICE_URL/" \
        --ack-deadline=300
    echo "Subscription created: $SUB_NAME -> $TOPIC_NAME"
else
    echo "Subscription already exists: $SUB_NAME"
    gcloud pubsub subscriptions update $SUB_NAME \
        --push-endpoint="$SERVICE_URL/"
    echo "Updated push endpoint for subscription: $SUB_NAME"
fi

echo "=== デプロイ完了 ==="
echo "Agent-A is now running at: $SERVICE_URL"
echo "Health check: curl $SERVICE_URL/healthz" 