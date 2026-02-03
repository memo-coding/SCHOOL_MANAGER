# Postman Collection for School Management System

This README provides instructions on how to use the Postman collection for the School Management System API. The collection includes various endpoints for managing students, teachers, classes, subjects, fees, and absences.

## Getting Started

1. **Install Postman**: If you haven't already, download and install Postman from [Postman's official website](https://www.postman.com/downloads/).

2. **Import the Collection**:
   - Open Postman.
   - Click on the "Import" button in the top left corner.
   - Select the "File" tab and choose the `SchoolManager.postman_collection.json` file located in the `docs/postman` directory of your project.
   - Click "Import" to add the collection to your Postman workspace.

3. **Set Up Environment Variables**:
   - Create a new environment in Postman by clicking on the gear icon in the top right corner and selecting "Manage Environments".
   - Add the following variables:
     - `baseUrl`: The base URL for your API (e.g., `http://localhost:5001`).
     - `jwtToken`: This will hold the JWT token for authentication after logging in.

## Authentication

Before accessing most endpoints, you need to authenticate and obtain a JWT token.

1. **Register a New User**:
   - Send a `POST` request to `{{baseUrl}}/api/auth/register` with the following JSON body:
     ```json
     {
       "email": "your_email@example.com",
       "password": "your_password",
       "role": "student" // or "teacher", "admin", "super_admin"
     }
     ```

2. **Login**:
   - Send a `POST` request to `{{baseUrl}}/api/auth/login` with the following JSON body:
     ```json
     {
       "email": "your_email@example.com",
       "password": "your_password"
     }
     ```
   - Copy the `token` from the response and set it as the value for the `jwtToken` variable in your environment.

## Using the Collection

The collection includes the following folders for different functionalities:

- **Authentication**: Contains endpoints for user registration and login.
- **Students**: Endpoints for managing student data (CRUD operations).
- **Teachers**: Endpoints for managing teacher data (CRUD operations).
- **Classes**: Endpoints for managing class data (CRUD operations).
- **Subjects**: Endpoints for managing subject data (CRUD operations).
- **Fees**: Endpoints for managing fee records and payments.
- **Absences**: Endpoints for recording and managing student absences.

### Example Request

To get a list of all students:

1. Select the `GET /api/students` request from the collection.
2. Make sure to add the `Authorization` header:
   - Key: `Authorization`
   - Value: `Bearer {{jwtToken}}`
3. Click "Send" to execute the request.

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "message": "Request successful",
  "data": { /* response data */ },
  "errors": [] // if any errors occurred
}
```

## Conclusion

This Postman collection provides a comprehensive way to test and interact with the School Management System API. Make sure to explore each endpoint and utilize the provided examples to understand the API's functionality better.