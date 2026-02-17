"""Database utilities for FleeTrack application"""

import os
import sys
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'fleetrack')

# Log to stderr for visibility
print(f"🗄️ [database.py] DB_NAME from env: {db_name}", file=sys.stderr)

# Global database client
_client = None
_db = None


def get_database():
    """Get MongoDB database instance"""
    global _client, _db
    
    if _db is None:
        _client = AsyncIOMotorClient(mongo_url)
        _db = _client[db_name]
        print(f"🗄️ [database.py] Connected to: {db_name}", file=sys.stderr)
    
    return _db


def get_client():
    """Get MongoDB client instance"""
    global _client
    
    if _client is None:
        _client = AsyncIOMotorClient(mongo_url)
    
    return _client


async def close_database():
    """Close database connection"""
    global _client
    
    if _client:
        _client.close()
        _client = None
