FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# PyMySQL is pure-Python (no libmysqlclient-dev needed); bcrypt/Pillow ship
# prebuilt wheels for this base image, so no compiler toolchain is required.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8010

CMD ["python", "manage.py", "runserver", "0.0.0.0:8010"]
