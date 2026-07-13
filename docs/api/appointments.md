# Appointments & Booking API

Base path: `/api/appointments` and `/api/experts` and `/api/payments`

Booking flow (VNPAY demo / sandbox — no real money):

1. Expert creates slots → `POST /api/experts/:id/slots`
2. Student books an available slot → `POST /api/appointments/book` (reserves slot, creates appointment in `pending_payment`)
3. Student pays → `POST /api/payments/appointment` (returns a VNPAY checkout URL)
4. VNPAY IPN marks the Payment `succeeded` and flips the appointment to `booked`

---

## POST /api/appointments/book

Book an available expert slot. Reserves the slot atomically and creates an appointment in `pending_payment`.

**Auth:** student, active.

### Request Body

```json
{
  "expertId": "665f1c2e9d3e4a0012ab0001",
  "slotId": "665f1c2e9d3e4a0012ab0002"
}
```

### Responses

**201 Created**
```json
{ "appointment": { "_id": "...", "status": "pending_payment", "amount": 200000, "...": "..." } }
```

**400** invalid `expertId`/`slotId` · **409** `{ "error": "Slot not available" }`

---

## GET /api/appointments/mine

List the authenticated student's appointments, sorted by `scheduledStartAt`.

**Auth:** student.

**200 OK** `{ "appointments": [ ... ] }`

---

## GET /api/appointments/expert

List appointments where the authenticated expert is the expert.

**Auth:** expert.

**200 OK** `{ "appointments": [ ... ] }`

---

## POST /api/appointments/:id/cancel

Cancel an appointment owned by the caller (student or expert). Reverts the slot to `available`. Only allowed when the appointment is `pending_payment` or `booked`.

**Auth:** student or expert owner.

**200 OK** `{ "message": "Appointment cancelled" }`

**403** not owner · **404** not found · **409** cannot be cancelled

---

## POST /api/experts/:id/slots

Create one or many availability slots. `expertId` is forced to the authenticated expert (client-supplied values ignored).

**Auth:** expert (must be the owner of `:id`).

### Request Body (single)

```json
{ "startAt": "2026-07-20T09:00:00.000Z", "endAt": "2026-07-20T09:45:00.000Z", "price": 200000 }
```

### Request Body (many)

```json
{ "slots": [ { "startAt": "...", "endAt": "...", "price": 200000 } ] }
```

**201 Created** `{ "slots": [ ... ] }`

---

## GET /api/experts/:id/slots

List the expert's own slots (all statuses).

**Auth:** expert (must be the owner of `:id`).

**200 OK** `{ "slots": [ ... ] }`

---

## GET /api/experts/:id/availability

Public. List only `available` slots for the expert, sorted by `startAt`.

**Auth:** none.

**200 OK** `{ "slots": [ ... ] }`

---

## DELETE /api/experts/slots/:slotId

Delete an expert's own slot. Rejected (409) if the slot is `booked`.

**Auth:** expert (owner of the slot).

**200 OK** `{ "message": "Slot deleted" }`

**404** not found · **409** `{ "error": "Cannot delete a booked slot" }`

---

## POST /api/payments/appointment

Create a VNPAY demo payment for a `pending_payment` appointment owned by the student. Returns a checkout URL.

**Auth:** student, active.

### Request Body

```json
{ "appointmentId": "665f1c2e9d3e4a0012ab1001" }
```

### Responses

**201 Created**
```json
{ "paymentId": "...", "orderCode": 1234567890123, "amount": 200000, "checkoutUrl": "https://sandbox.vnpayment.vn/...", "expiresAt": "2026-07-20T..." }
```

**403** not owner · **404** not found · **409** not awaiting payment

---

## POST /api/payments/vnpay/ipn

VNPAY IPN (server-to-server) callback. Public. Verifies the signature, then marks the Payment `succeeded` and the appointment `booked`. Always responds `200` with a VNPAY `RspCode`/`Message` JSON.

**Auth:** none.

**200 OK** `{ "RspCode": "00", "Message": "Success" }` (or `97` invalid signature, `01` not found)

---

## GET /api/payments/vnpay/return

VNPAY return (browser redirect) callback. Public. Verifies the signature and redirects to `${VNPAY_RETURN_URL}?status=success|failed`.

**Auth:** none.

**302** redirect to `${VNPAY_RETURN_URL}?status=success` (or `failed`)

**400** `{ "error": "invalid" }` when signature verification fails
