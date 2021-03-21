exports.createErrorResponse = errors => {
    let response = [];

    errors.forEach(error => {
        let obj = {};
        obj[error.param] = error.msg;

        response.push(obj);
    });

    return response;
};