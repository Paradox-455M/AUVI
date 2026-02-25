package response

import (
	"encoding/json"
	"net/http"
)

// Envelope is the standard API response wrapper.
// Every response goes through this for frontend predictability.
type Envelope struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
	Error   *ErrorBody  `json:"error,omitempty"`
}

// ErrorBody is the structured error payload.
type ErrorBody struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// JSON writes a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Envelope{
		Success: true,
		Data:    data,
	})
}

// JSONWithMeta writes a JSON response with pagination/meta info.
func JSONWithMeta(w http.ResponseWriter, status int, data interface{}, meta interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Envelope{
		Success: true,
		Data:    data,
		Meta:    meta,
	})
}

// Err writes a structured error response.
func Err(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Envelope{
		Success: false,
		Error: &ErrorBody{
			Code:    code,
			Message: message,
		},
	})
}

// ErrWithDetails writes a structured error with field-level details.
func ErrWithDetails(w http.ResponseWriter, status int, code string, message string, details interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Envelope{
		Success: false,
		Error: &ErrorBody{
			Code:    code,
			Message: message,
			Details: details,
		},
	})
}
