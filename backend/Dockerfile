FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app/backend

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

ARG INSTALL_FULL_STACK=false
COPY backend/requirements-rag.txt /tmp/requirements-rag.txt
RUN if [ "$INSTALL_FULL_STACK" = "true" ]; then \
      pip install --no-cache-dir -r /tmp/requirements-rag.txt; \
    fi

COPY backend/ /app/backend/
RUN mkdir -p /app/backend/data /app/backend/var && \
    useradd --create-home --uid 10001 safeher && \
    chown -R safeher:safeher /app/backend

USER safeher

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
