import streamlit as st
from database_manager import *
import os
from config import PATH_config
from logo import add_logo

st.set_page_config(layout="wide")

# Ajouter le logo à la barre latérale
add_logo()

if not os.path.exists(PATH_config.db_path):
    init_db(PATH_config.db_path)
    populate_db(PATH_config.db_path)
