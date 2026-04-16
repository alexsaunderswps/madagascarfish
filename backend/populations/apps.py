from django.apps import AppConfig


class PopulationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "populations"

    def ready(self) -> None:
        import populations.signals  # noqa: F401
