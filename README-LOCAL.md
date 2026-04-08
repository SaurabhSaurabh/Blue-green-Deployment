# Blue-Green Deployment with Kubernetes

A complete blue-green deployment setup featuring a Node.js backend API with MongoDB, dual frontend versions (blue and green), and Kubernetes orchestration with ingress routing.

## 🏗️ Architecture

- **Backend**: Node.js/Express API server with MongoDB integration
- **Frontend**: Two versions (Blue and Green) with environment-aware API calls
- **Database**: MongoDB with persistent storage
- **Ingress**: Nginx ingress controller for routing
- **Deployment Strategy**: Blue-green deployment with service switching

## 📋 Prerequisites

- Docker Desktop with Kubernetes enabled
- kubectl CLI
- Node.js (for local development)
- Basic understanding of Kubernetes concepts

## 🚀 Quick Start

### 1. Clone and Build Images

```bash
# Build backend image
docker build -t blue-green:backend ./backend/

# Build frontend images
docker build -t blue-green:frontend-blue ./frontend-blue/
docker build -t blue-green:frontend-green ./frontend-green/
```

### 2. Deploy to Kubernetes

```bash
# Apply all Kubernetes manifests
kubectl apply -f k8s/

# Wait for deployments to be ready
kubectl get pods -w
```

### 3. Access the Application

- **Frontend**: http://frontend.local/
- **Health Check**: http://frontend.local/health
- **API Endpoints**:
  - GET /api/users - List all users
  - POST /api/users - Create new user
  - GET /api/users/count - Get user count

## 📁 Project Structure

```
├── backend/                 # Node.js API server
│   ├── Dockerfile
│   ├── server.js
│   ├── package.json
│   ├── models/
│   │   └── user.js
│   └── routes/
│       └── users.js
├── frontend-blue/          # Basic UI version
│   ├── Dockerfile
│   ├── server.js
│   ├── package.json
│   └── public/
│       └── index.html
├── frontend-green/          # Enhanced UI version
│   ├── Dockerfile
│   ├── server.js
│   ├── package.json
│   └── public/
│       ├── app.js
│       └── index.html
├── k8s/                    # Kubernetes manifests
│   ├── deployments/
│   │   ├── backend_deployment.yml
│   │   ├── frontend_blue_deployment.yml
│   │   ├── mongo_deployment.yml
│   ├── services/
│   │   ├── backend_service.yml
│   │   ├── mongo_service.yml
│   ├── app_configmap.yml
│   ├── mongo_pv.yml
│   ├── mongo_pvc.yml
│   └── frontend_ingress.yml
├── docker-compose.yml       # Local development setup
└── README.md
```

## 🔧 Kubernetes Components

### Services
- **frontend-service**: Routes to active frontend (blue/green)
- **backend**: API server service
- **mongo**: MongoDB database service

### Ingress Configuration
- `frontend.local/` → Frontend service
- `frontend.local/api/*` → Backend service
- `frontend.local/health` → Backend service

### Persistent Storage
- MongoDB data persists in `/mnt/data/mongodb-fresh` on host

## 🔄 Blue-Green Deployment

### Switching Between Versions

```bash
# Check current service selector
kubectl get service frontend-service -o yaml

# Switch to green version
kubectl patch service frontend-service -n default --type=merge -p '{"spec":{"selector":{"app":"frontend-green"}}}'

# Switch to blue version
kubectl patch service frontend-service -n default --type=merge -p '{"spec":{"selector":{"app":"frontend-blue"}}}'
```

### Deployment Strategy
1. Deploy both blue and green versions simultaneously
2. Test the inactive version thoroughly
3. Switch traffic by updating the service selector
4. Keep old version running for quick rollback

## 🧪 Testing

### API Testing

```bash
# Health check
curl http://frontend.local/health

# Get users
curl http://frontend.local/api/users

# Create user
curl -X POST http://frontend.local/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "surname": "Test",
    "dob": "1990-01-01",
    "job": "Developer",
    "place": "Test City",
    "interests": ["coding", "reading"],
    "knownLanguages": ["English", "JavaScript"],
    "registeredFrom": "basic"
  }'
```

### Database Access

```bash
# Port forward MongoDB
kubectl port-forward svc/mongo 27017:27017 -n default

# Connect with authentication
mongosh "mongodb://admin:admin123@localhost:27017/mybgapp?authSource=admin"
```

## 🐛 Troubleshooting & Learning Section

### Issues Encountered & Resolutions

#### 1. **API 404 Errors Through Ingress**
**Problem**: POST requests to `/api/users` returned 404 errors despite correct ingress routing.

**Root Cause**: Backend server was only listening on `127.0.0.1` instead of `0.0.0.0`, preventing external access through Kubernetes services.

**Solution**:
```javascript
// In backend/server.js - BEFORE
app.listen(PORT);

// AFTER
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});
```

**Learning**: In Kubernetes, containers must bind to `0.0.0.0` to accept connections from outside the pod. Default `127.0.0.1` only accepts local connections.

#### 2. **MongoDB Authentication Failures**
**Problem**: Backend pods crashed with "Authentication failed" errors.

**Root Cause**: Connection string used `mongodb://admin:admin123@mongo:27017/mybgapp` but MongoDB root user was created in `admin` database, not `mybgapp`.

**Solution**: Updated connection string to include `?authSource=admin`:
```javascript
mongoose.connect(process.env.MONGO_URI)
// Where MONGO_URI = mongodb://admin:admin123@mongo:27017/mybgapp?authSource=admin
```

**Learning**: MongoDB authentication database (`authSource`) specifies which database contains the user credentials. Root users are typically stored in the `admin` database.

#### 3. **Ingress Path Rewriting Conflicts**
**Problem**: `/health` endpoint returned 404 despite correct ingress configuration.

**Root Cause**: `nginx.ingress.kubernetes.io/rewrite-target: /` annotation was rewriting all paths, interfering with exact matches.

**Solution**: Removed the rewrite-target annotation:
```yaml
# BEFORE
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /

# AFTER
annotations: {}  # or remove entirely
```

**Learning**: Nginx ingress rewrite-target affects all paths. For exact path matches, either remove the annotation or use conditional rewriting.

#### 4. **PVC Deletion Issues**
**Problem**: MongoDB PVC couldn't be deleted due to finalizers.

**Root Cause**: Kubernetes PVC had finalizers preventing deletion.

**Solution**:
```bash
# Remove finalizers
kubectl patch pvc mongo-pvc -n default --type=merge -p '{"metadata":{"finalizers":[]}}'

# Force delete
kubectl delete pvc mongo-pvc -n default --force --grace-period=0
```

**Learning**: PVC finalizers protect against accidental data loss. Use `--force` only when certain data can be lost.

#### 5. **Environment-Aware Frontend URLs**
**Problem**: Frontend needed different API URLs for local Docker vs Kubernetes ingress.

**Solution**: Added hostname detection in JavaScript:
```javascript
const isIngress = window.location.hostname !== 'localhost';
const apiUrl = isIngress ? '/api/users' : 'http://localhost:5000/api/users';
```

**Learning**: Frontends should detect deployment environment to use appropriate API endpoints.

### Key Learnings

1. **Network Binding**: Always bind services to `0.0.0.0` in Kubernetes containers
2. **Authentication Databases**: Understand MongoDB's authentication database concept
3. **Ingress Path Types**: Use appropriate path types (Prefix vs Exact) and understand rewrite rules
4. **Service Selectors**: Blue-green switching works by updating service selectors
5. **PVC Management**: Handle persistent volume claims carefully, especially with data
6. **Environment Detection**: Frontends should adapt to different deployment environments
7. **Port Forwarding**: Useful for debugging but not for production access
8. **Health Checks**: Implement proper liveness and readiness probes
9. **Secrets Management**: Store sensitive data in Kubernetes secrets
10. **Rollback Strategy**: Keep old deployments running during blue-green switches

### Debugging Commands

```bash
# Check pod status
kubectl get pods -n default

# View logs
kubectl logs <pod-name> -n default --tail=20

# Check ingress
kubectl describe ingress frontend-ingress -n default

# Port forward for debugging
kubectl port-forward svc/backend 5000:5000 -n default

# Check service endpoints
kubectl get endpoints -n default

# Test API directly
curl http://localhost:5000/health  # After port forwarding
```

## 📚 Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [MongoDB Authentication](https://docs.mongodb.com/manual/core/authentication/)
- [Nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Blue-Green Deployment Strategy](https://martinfowler.com/bliki/BlueGreenDeployment.html)

## 🤝 Contributing

1. Test changes in a local Kubernetes cluster
2. Update documentation for any configuration changes
3. Follow the troubleshooting patterns documented above
4. Ensure both blue and green versions work correctly

---

**Note**: This setup is designed for learning and demonstration purposes. For production use, consider security hardening, monitoring, and CI/CD integration.
# Apply all manifests
kubectl apply -f k8s/

# Verify deployments
kubectl get deployments
kubectl get services