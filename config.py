import base64


class PATH_config:
    svg_path = "map/map.svg"
    image_path = "map/map.png"
    db_path = "farming_simulator.db"


# Fonction pour récupérer l'image basée sur le chemin
def get_image(img_path: str) -> str:
    try:
        with open(img_path, "rb") as file_:
            contents = file_.read()
            data_url = base64.b64encode(contents).decode("utf-8")
        return data_url
    except FileNotFoundError:
        print(f"Erreur : {img_path} introuvable.")
        return ""


CSS = """
<style>
h1 {
    text-align: center;
}
</style>
"""
