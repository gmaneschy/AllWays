FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# GDAL/GEOS/PROJ pro django.contrib.gis — é exatamente essa instalação que
# é dolorosa no Windows nativo (OSGeo4W + DLL path) e aqui vira 1 apt-get.
# ffmpeg entra na mesma leva: usado pela compressão de vídeo (apps.itineraries.tasks
# e apps.social.tasks) via ffmpeg-python, que só chama o binário — não precisa de lib de dev.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]