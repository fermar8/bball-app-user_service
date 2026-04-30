#!/bin/bash
set -e

# Idempotency check - skip if already set up
if [ -f /opt/docker-installed ]; then
  echo "Setup already complete, skipping..."
  exit 0
fi

echo "Installing Docker and CloudWatch agent..."

# Install Docker and CloudWatch agent (skip yum update to save time)
yum install -y docker amazon-cloudwatch-agent

# Start and enable Docker
systemctl enable docker
systemctl start docker

# Add ec2-user to docker group
usermod -a -G docker ec2-user || true

# Enable CloudWatch agent (will be configured via deploy script)
systemctl enable amazon-cloudwatch-agent

# Mark setup as complete
touch /opt/docker-installed
echo "Setup complete at $(date)."
