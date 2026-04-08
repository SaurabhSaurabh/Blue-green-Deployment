# Blue-Green Deployment Project

## Overview
A Kubernetes-based blue-green deployment setup with Node.js backend, MongoDB database, and dual frontend versions.

## Prerequisites
- Docker Desktop with Kubernetes enabled
- kubectl CLI
- Administrator privileges (for hosts file editing)

## Setup Steps

### 1. Configure Local DNS
Add the following entry to your hosts file to access the application:

**Windows**: `C:\Windows\System32\drivers\etc\hosts`
**Linux/Mac**: `/etc/hosts`

```
127.0.0.1 frontend.local
```

### 2. Build Docker Images
```bash
# Build all required images
docker build -t blue-green:backend ./backend/
docker build -t blue-green:frontend-blue ./frontend-blue/
docker build -t blue-green:frontend-green ./frontend-green/
```

### 3. Create MongoDB Secret
```bash
# Create the MongoDB connection secret
kubectl create secret generic mongo-secret \
  --from-literal=MONGO_URI='mongodb://admin:admin123@mongo:27017/mybgapp?authSource=admin'
```

### 4. Deploy to Kubernetes (Execution Order)

**Important**: Deploy in this specific order to ensure dependencies are met:

```bash
# 1. Create persistent storage first
kubectl apply -f k8s/mongo_pv.yml
kubectl apply -f k8s/mongo_pvc.yml

# 2. Deploy MongoDB
kubectl apply -f k8s/deployments/mongo_deployment.yml
kubectl apply -f k8s/services/mongo_service.yml

# 3. Create ConfigMap
kubectl apply -f k8s/app_configmap.yml

# 4. Deploy backend
kubectl apply -f k8s/deployments/backend_deployment.yml
kubectl apply -f k8s/services/backend_service.yml

# 5. Deploy both frontend versions
kubectl apply -f k8s/deployments/frontend_blue_deployment.yml
kubectl apply -f k8s/deployments/frontend_green_deployment.yml

# 6. Create frontend service (starts with blue by default)
kubectl apply -f k8s/services/frontend_service.yml

# 7. Apply ingress for external access
kubectl apply -f k8s/frontend_ingress.yml
```

### 5. Verify Deployment
```bash
# Check all resources are running
kubectl get pods -n default
kubectl get services -n default
kubectl get ingress -n default

# Check ingress controller is available
kubectl get pods -n ingress-nginx
```

## Project Structure
```
├── backend/          # Node.js API server
├── frontend-blue/    # Basic frontend version
├── frontend-green/   # Enhanced frontend version
├── k8s/             # Kubernetes manifests
│   ├── deployments/
│   ├── services/
│   ├── mongo_pv.yml
│   ├── mongo_pvc.yml
│   ├── app_configmap.yml
│   └── frontend_ingress.yml
└── docker-compose.yml
```

## Access the Application

### Frontend Access
- **URL**: http://frontend.local/
- **Currently Active**: Blue version (default)

### API Endpoints
- **Health Check**: http://frontend.local/health
- **Users API**: http://frontend.local/api/users
- **User Count**: http://frontend.local/api/users/count

### Database Access
```bash
# Port forward for local access
kubectl port-forward svc/mongo 27017:27017 -n default

# Connect with MongoDB client
mongosh "mongodb://admin:admin123@localhost:27017/mybgapp?authSource=admin"
```

## Blue-Green Switching

### Check Current Version
```bash
kubectl get service frontend-service -o yaml
```

### Switch to Green Version
```bash
kubectl patch service frontend-service -n default \
  --type=merge \
  -p '{"spec":{"selector":{"app":"frontend-green"}}}'
```

### Switch to Blue Version
```bash
kubectl patch service frontend-service -n default \
  --type=merge \
  -p '{"spec":{"selector":{"app":"frontend-blue"}}}'
```

## Troubleshooting

### Common Issues

**1. Ingress not working**
```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress status
kubectl describe ingress frontend-ingress
```

**2. Pods not starting**
```bash
# Check pod status and logs
kubectl get pods
kubectl logs <pod-name> --tail=20
```

**3. Service not accessible**
```bash
# Check service endpoints
kubectl get endpoints

# Test internal connectivity
kubectl exec -it <pod-name> -- curl http://backend:5000/health
```

### Useful Commands
```bash
# View all resources
kubectl get all

# Delete everything and restart
kubectl delete -f k8s/

# Check persistent volumes
kubectl get pv,pvc

# View logs for specific component
kubectl logs -l app=backend
kubectl logs -l app=frontend-blue
kubectl logs -l app=mongodb
```

## Architecture Details

- **Backend**: Node.js/Express API with MongoDB
- **Frontend**: Two versions with environment-aware API calls
- **Database**: MongoDB with persistent storage
- **Ingress**: Nginx ingress for path-based routing
- **Storage**: HostPath persistent volume for MongoDB data

## Development

### Local Testing with Docker Compose
```bash
docker-compose up -d
# Access at http://localhost:3100 (blue) and http://localhost:3200 (green)
```

### Making Changes
1. Update code in respective directories
2. Rebuild Docker images with new tags
3. Update Kubernetes deployments
4. Rollout restart: `kubectl rollout restart deployment/<name>`

## Security Notes
- MongoDB credentials are stored in Kubernetes secrets
- Default credentials: admin/admin123 (change for production)
- Ingress provides basic routing (consider TLS for production)
- No authentication implemented in the API (add for production)
kubectl get pods
```

### 7. Blue-Green Switching

#### Switch Traffic Methods

1. Basic Patch Command
```bash
# Switch to Green
kubectl patch service frontend-service -p '{"spec":{"selector":{"version":"green"}}}'

# Switch back to Blue
kubectl patch service frontend-service -p '{"spec":{"selector":{"version":"blue"}}}'
```

2. Detailed Patch Command
```bash
kubectl patch service frontend-service --type='merge' -p '{
  "spec":{
    "selector":{
      "app":"frontend",
      "version":"green"
    }
  }
}'
```

### 8. Verification
- Check service endpoints
- Verify traffic routing
- Monitor application logs

### Troubleshooting
- `kubectl get pods` - Check pod status
- `kubectl logs <pod-name>` - View logs
- `kubectl describe service frontend-service` - Service details

### Cleanup
```bash
# Remove deployments
kubectl delete -f k8s/

# Stop Minikube
minikube stop
```

## Blue-Green Deployment Flow Chart

```mermaid
graph TD
    A[Blue Environment Running] -->|Deploy Green| B[Green Environment Prepared]
    B -->|Validate Green| C{Green Ready?}
    C -->|Yes| D[Update Service Selector]
    C -->|No| B
    D -->|Redirect Traffic| E[Green Now Active]
    E -->|Rollback Option| A
```

### Flow Explanation
1. Blue environment is initial production
2. Green environment deployed alongside
3. Validate green environment 
4. Update service selector
5. Redirect traffic to green
6. Blue remains as rollback option

## Best Practices
- Implement health checks
- Use resource limits
- Configure monitoring
- Validate before switching
- Maintain rollback strategy


## License
This project is licensed under the MIT License
