FROM python:3.11-slim

# Install system deps for librosa/soundfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends libsndfile1 ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer caching)
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# Copy source and artifacts
COPY src/ src/
COPY api/ api/
COPY artifacts/ artifacts/

EXPOSE 8100

CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8100"]
