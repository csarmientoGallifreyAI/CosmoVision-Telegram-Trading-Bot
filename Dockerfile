FROM python:3.9-slim

WORKDIR /app

# Copy requirements file first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create data directory if it doesn't exist
RUN mkdir -p data

# Run the application
CMD ["python", "src/main.py"]