class WorkbookError(Exception):
    """Error de dominio relacionado con la carga o lectura de Excel."""


class InvalidWorkbookError(WorkbookError):
    """El archivo no es un .xlsx valido."""


class WorkbookTooLargeError(WorkbookError):
    """El archivo supera el limite de tamaño permitido."""


class WorkbookLimitError(WorkbookError):
    """La estructura del libro supera los limites configurados."""


class WorkbookParseTimeoutError(WorkbookError):
    """El parsing excedio el tiempo maximo permitido."""


class WorkbookNotFoundError(WorkbookError):
    """El libro o la hoja solicitada no existe."""
