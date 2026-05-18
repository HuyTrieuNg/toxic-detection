from django.apps import AppConfig


def _warm_up_models() -> None:
    import sys

    if 'test' in sys.argv:
        return

    from pipeline.services.inference import load_model_bundle

    load_model_bundle()


class PipelineConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'pipeline'

    def ready(self):
        _warm_up_models()
