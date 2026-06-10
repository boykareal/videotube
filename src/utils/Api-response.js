class ApiResponse{
    constructor(statuscode, data, message = "Success"){
        this.statuscode = statuscode
        this.data = data
        this.message = message
        this.Success = statuscode < 400
    }
}

export { ApiResponse }