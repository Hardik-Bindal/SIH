FROM python:3.11-slim

WORKDIR /srv

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY ml ml
COPY data data
COPY backend backend

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/srv
WORKDIR /srv

# Generate ML models and analytics artifacts during the build process
# This takes ~30 seconds and ensures the models are baked into the container.
RUN python ml/pipeline/etl.py && \
    python ml/pipeline/embeddings.py && \
    python ml/models/train_sif_classifier.py && \
    python ml/models/train_lsr_mapper.py && \
    python ml/models/build_analytics_artifacts.py

WORKDIR /srv/backend
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
