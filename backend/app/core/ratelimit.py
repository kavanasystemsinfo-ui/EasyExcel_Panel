"""Rate limit por IP en memoria: ventana deslizante acotada, single-instance.

Mecanismo compartido por el copiloto (20 consultas/día, ADR-0006) y por las
subidas de Excel (30/hora). La IP real sale de la ÚLTIMA posición de
X-Forwarded-For: la primera la controla el cliente y se ignora para no
permitir spoofing detrás del proxy de Render.
"""

from __future__ import annotations

import ipaddress
import logging
import time
from collections import OrderedDict

from fastapi import Request

logger = logging.getLogger("easyexcel.ratelimit")

# Cota de memoria del mapa: las IPs no suelen crecer más que esto en una
# ventana; al superarse se purgan las ventanas ya caducadas.
MAX_IPS = 10_000


class LimiteExcedido(Exception):
    """Se superó el máximo de peticiones de una IP en la ventana."""


def _agrupar(ip: str) -> str:
    """Las IPv6 se agrupan por /64: un cliente suele controlar todo su /64 y,
    contando cada direccion por separado, rotaria de cubo a voluntad."""
    try:
        direccion = ipaddress.ip_address(ip)
    except ValueError:
        return ip
    if isinstance(direccion, ipaddress.IPv6Address):
        red = ipaddress.IPv6Network((direccion, 64), strict=False)
        return f"{red.network_address}/64"
    return ip


def ip_real(request: Request) -> str:
    """IP del cliente tras el proxy: última entrada de X-Forwarded-For."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return _agrupar(xff.split(",")[-1].strip())
    return _agrupar(request.client.host) if request.client else "anonimo"


class RateLimiter:
    """Ventana deslizante por IP con purga de ventanas caducadas."""

    def __init__(self, max_ips: int = MAX_IPS) -> None:
        self.max_ips = max_ips
        self._ventanas: OrderedDict[str, list[float]] = OrderedDict()

    def limpiar(self) -> None:
        self._ventanas.clear()

    def comprobar(self, ip: str, limite: int, ventana_s: float, etiqueta: str) -> None:
        """Cuenta una petición o lanza LimiteExcedido si la IP está en su tope."""
        ahora = time.monotonic()
        if len(self._ventanas) > self.max_ips:
            caducadas = [
                clave
                for clave, marcas in self._ventanas.items()
                if not marcas or ahora - max(marcas) >= ventana_s
            ]
            for clave in caducadas:
                del self._ventanas[clave]
        marcas = [t for t in self._ventanas.get(ip, []) if ahora - t < ventana_s]
        if len(marcas) >= limite:
            self._ventanas[ip] = marcas
            if ventana_s >= 3600:
                horas = ventana_s // 3600
                espera = f"{int(horas)} hora" if horas == 1 else f"{int(horas)} horas"
            else:
                minutos = ventana_s // 60
                espera = (
                    f"{int(minutos)} minuto"
                    if minutos == 1
                    else f"{int(minutos)} minutos"
                )
            # Deja rastro de quien se topa con el limite: sirve para comprobar
            # en produccion que cada visitante cae en su propio cubo.
            logger.warning(
                "limite excedido: %s ip=%s limite=%d/%ss", etiqueta, ip, limite, int(ventana_s)
            )
            raise LimiteExcedido(
                f"Demasiadas {etiqueta}. Vuelve a intentarlo en {espera}."
            )
        marcas.append(ahora)
        self._ventanas[ip] = marcas
