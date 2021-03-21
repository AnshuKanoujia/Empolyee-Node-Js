const Validator = require("validator");
const isEmpty = require("is-empty");

module.exports = function validateLoginInput(data) {
    let errors = {};
    // Convert empty fields to an empty string so we can use validator functions
    data.password = !isEmpty(data.password) ? data.password : "";

    if (data.type == "email") {
        data.identity = !isEmpty(data.identity) ? data.identity : "";
        if (Validator.isEmpty(data.identity)) {
            errors.identity = "Email field is required";
        } else if (!Validator.isEmail(data.identity)) {
            errors.identity = "Email is invalid";
        }

    }
    if (data.type == "mobile") {
        data.identity = !isEmpty(data.identity) ? data.identity : "";
        if (Validator.isEmpty(data.identity)) {
            errors.identity = "Phone Number field is required";
        }

    }
    // Password checks
    if (Validator.isEmpty(data.password)) {
        errors.password = "Password field is required";
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};