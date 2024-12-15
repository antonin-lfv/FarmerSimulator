from streamlit import markdown
from config import get_image


def add_logo():
    markdown(
        """
        <style>
            [data-testid="stSidebarNav"] {
                background-image: url(https://github.com/user-attachments/assets/f41dae08-8406-46e3-ad92-2702c563dcc8);
                background-repeat: no-repeat;
                padding-top: 170px;
                background-position: 20px 20px;
                background-size: 150px;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )
