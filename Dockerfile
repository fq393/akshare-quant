# Stage 1: Build Frontend
FROM docker.1ms.run/library/node:18-alpine as frontend-builder
WORKDIR /app/frontend

# Copy package files first for better caching
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source code
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Backend and Runtime
FROM docker.1ms.run/library/python:3.10-slim 
WORKDIR /app

# Install system dependencies
# gcc/g++ are often needed for compiling python extensions (pandas, numpy, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
# Using a mirror for potentially faster downloads in relevant regions
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# Copy backend code
COPY server/ ./server/

# Copy built frontend assets from the builder stage
# Placed into 'static' directory which server/main.py is configured to serve
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose the application port
EXPOSE 8000

# Set environment variables
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1

# Start the application
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
