from app.core.database import engine, Base
from app.models.payment import Payment

Base.metadata.create_all(bind=engine)
