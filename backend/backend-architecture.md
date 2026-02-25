# Backend Architecture: Cinematic Music Gallery

## 1. Language & Framework Choice
**Selection:** Go (1.21+) with `net/http` and `sqlc`

**Justification:** 
The requirements state the backend must be "boring, stable, clean, predictable, and extensible." Go perfectly embodies these traits. Its strict typing, explicit error handling, and lack of "magic" make the codebase highly predictable and easy to reason about. The standard library `net/http` provides a robust, zero-dependency foundation for our REST API. `sqlc` generates type-safe Go code from raw SQL schemas, ensuring maximum control over PostgreSQL queries without the query unpredictability and overhead of a heavy ORM layer like Prisma or GORM. 

Additionally, we need to handle multi-part file uploads safely. Go's lightweight goroutines and built-in concurrency primitives provide excellent memory management during large file ingestions (no Node.js event-loop blocking). This perfectly sets up the backend for heavy audio handling.

## 2. System Boundaries
- **API Layer (`internal/api/`):** Exclusively handles HTTP request parsing, payload validation, and serializing responses. Agnostic to business logic.
- **Service Layer (`internal/services/`):** Contains core business logic (e.g., track validation, associating tags, computing the gallery layout). Agnostic to HTTP constraints.
- **Storage Layer (`internal/storage/`):** Abstracts filesystem operations for audio. A clear interface boundary prepares us for direct S3 integration.
- **Data Access Layer (`internal/repository/`):** Single point of interaction with PostgreSQL via `sqlc` generated code.

## 3. API Philosophy
- **RESTful Paradigm:** Clean, noun-based resource endpoints (e.g., `/api/v1/tracks`).
- **Stateless:** Every HTTP request contains all necessary data and context to be processed independently.
- **Strict Versioning:** Starting at `v1`, prefixed in the URL (`/api/v1/...`). Guarantees no downstream breakages when the mobile/frontend apps upgrade.
- **Predictable Responses:** Every response strictly follows a standard JSON envelope format, keeping the frontend integration extremely simple.

## 4. Folder Structure Tree
```text
.
├── cmd/
│   └── api/                # Application entrypoint (main.go)
├── internal/
│   ├── api/                # API Controller Agent territory
│   │   ├── handlers/       # Endpoint controllers
│   │   ├── middleware/     # Security Agent territory
│   │   └── server/         # net/http server setup
│   ├── config/             # Environment & configuration parsing
│   ├── domain/             # Domain Model Agent territory (structs, interfaces)
│   ├── repository/         # Data access via sqlc
│   ├── services/           # Tag, Gallery & Track Agents territory
│   └── storage/            # File & Storage Agent territory
├── sql/
│   ├── migrations/         # PostgreSQL schema files
│   └── queries/            # sqlc SQL query definitions
├── pkg/                    # Reusable pure functions (e.g., audio metadata parsers)
└── go.mod
```

## 5. Request/Response Conventions
All successful API responses return a `200` or `201` HTTP status code with the following predictable envelope:
```json
{
  "success": true,
  "data": { ... },       // The requested resource(s) or array
  "meta": { ... }        // Optional (e.g., pagination info)
}
```

## 6. Error Handling Strategy
Errors are explicitly logged internally, but sanitized before being returned to the client to prevent leaking system context. Rejections return `4xx` or `5xx` with:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED", // Machine-readable code for frontend conditionals
    "message": "Invalid audio file format", // Human-readable message
    "details": [] // Optional field-specific errors
  }
}
```

**Standard HTTP Status Mapping:**
- `400 Bad Request`: Validation failures, malformed JSON
- `401/403`: Unauthorized / Forbidden (Prepared for future accounts)
- `404 Not Found`: Specific ID or route not found
- `409 Conflict`: Duplicate file hashing or tag collisions
- `413 Payload Too Large`: Upload limits breached
- `500 Internal Server Error`: Unhandled server exception (sanitized output)

## 7. Future Scalability Plan
1. **Database:** Standardizing purely on `sqlc` generated Postgres code ensures deep control over complex indexing and query planning once usage scales. No ORM abstraction leaks.
2. **Storage Migration:** The core `Storage` interface currently wraps local `os` operations logic natively. Scaling to S3 is handled simply by configuring the container with an AWS/S3 struct that satisfies the same interface.
3. **Analytics/Visualizer Processing:** Utilizing Go channels, future `PlaybackEvent`s can be buffered in memory and batched to the database asynchronously, preventing DB locking under extreme traffic loads from the cinematic frontend visualizers.
