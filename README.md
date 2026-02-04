# tpay

python -m venv venv
pip install -r requirements.txt
uvicorn app.main:app --reload
alembic revision --autogenerate -m "baseline_schema"
alembic upgrade head