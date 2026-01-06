# Guía de Pruebas de Mercado Pago - Judic-IA 💳

Para probar el flujo de suscripción sin utilizar dinero real, puedes usar las siguientes tarjetas de prueba provistas por Mercado Pago (Sandbox).

> [!IMPORTANT]
> **Datos Mandatorios para Pruebas:**
> - **Nombre del titular**: `APRO` (para simular pago aprobado)
> - **DNI**: `12345678`
> - **Email**: `test@testuser.com` (Usa este email opcionalmente para máxima compatibilidad)

## ⚠️ Instrucciones Cruciales para Evitar Errores
Mercado Pago es muy estricto con las pruebas. Si ves el error *"Una de las partes con la que intentás hacer el pago es de prueba"*, sigue estos pasos:

1.  **Usa una Ventana de Incógnito**: Es la forma más segura de testear. Esto evita que Mercado Pago detecte tu sesión real de administrador.
2.  **Cierra Sesión**: Asegúrate de **NO estar logueado** en tu cuenta real de Mercado Pago en el navegador donde hagas la prueba. No puedes pagarte a ti mismo, ni siquiera con tarjetas de prueba.
3.  **No uses tu Email Real**: En el formulario de pago, usa un email ficticio (ej: `test_user_123@test.com`).

---

## 💳 Tarjetas de Prueba (Sandbox)
Selecciona una tarjeta según el resultado que desees obtener:

| Marca | Número de Tarjeta | Código (CVV) | Vencimiento | Resultado |
| :--- | :--- | :--- | :--- | :--- |
| **Visa** | `4509 9535 6623 3704` | `123` | `11/30` | ✅ Aprobado |
| **Mastercard** | `5031 7557 3453 0604` | `123` | `11/30` | ✅ Aprobado |
| **Amex** | `3711 803032 57522` | `1234` | `11/30` | ✅ Aprobado |

## Escenarios de Error (Para testear fallos)

- **Fondos Insuficientes**: Usa la tarjeta `4509 9535 6623 3704` pero pon como titular `CONT` (Case: Fondos Insuficientes).
- **Tarjeta Expirada**: Usa `4509 9535 6623 3704` con vencimiento anterior al actual.

---
*Documentación generada por Antigravity para el equipo de Judic-IA.*
