FROM python:3.11-slim

WORKDIR /srv

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY ml ml
COPY data data
COPY backend backend

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/srv
ENV MALLOC_ARENA_MAX=2
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
WORKDIR /srv

# Models are now tracked in git, no need to build them in the cloud.
WORKDIR /srv/backend
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
