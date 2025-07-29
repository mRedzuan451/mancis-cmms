# mancis-cmms

ManCIS - Maintenance & Inventory System
ManCIS is a web-based Computerized Maintenance Management System (CMMS) designed to help organizations manage their assets, track maintenance tasks, and control spare parts inventory efficiently. It provides a centralized platform for maintenance teams, from technicians to managers, to streamline their workflows, reduce downtime, and make data-driven decisions.

Core Functionality
The system is divided into several key modules, each with specific features and access levels based on user roles.

Dashboard
+ At-a-Glance KPIs
- Displays key performance indicators like open work orders, pending part requests, and low-stock items.
+ Work Order Status Chart
- Visualizes the current status of all work orders in a doughnut chart.
+ Upcoming & Overdue WO Lists
- Highlights upcoming Preventive Maintenance (PM) tasks and alerts for overdue work orders.
+ Inventory & Cost Reports
- Generates detailed reports on inventory movement and maintenance costs for a selected date range.
+ KPI Reports
- Calculates and displays key maintenance metrics like Mean Time To Repair (MTTR) and Mean Time Between Failures (MTBF).

Assets management
+ Centralized Asset Registry
- Create, read, update, and delete (CRUD) operations for all company assets, including machinery and equipment.
+ Asset Hierarchy & Location
- Assign assets to specific, multi-level locations (e.g., Division > Department > Production Line).
+ Status Tracking
- Track the status of assets (e.g., Active, Inactive, Decommissioned).
+ Bulk Upload
- Upload and update a list of assets from a CSV file.
+ History Tracking
- View a complete history of work orders and transfers for each asset.

Inventory & Parts
+ Spare Parts Database
- Full CRUD operations for all spare parts, including details like SKU, maker, supplier, and price.
+ Low-Stock Alerts
- Automatically identifies parts that have fallen below their minimum quantity threshold.
+ Automated Part Requests
- Automatically generates purchase requests for low-stock items that do not already have an open request.
+ Multi-Step Request Workflow
- A complete workflow: Request -> Approve/Reject -> Receive -> Restock.
+ Stock Take Module
- Initiate, perform, and approve physical stock counts to reconcile system quantities with actual on-hand inventory.

Work Order Management
+ Corrective & Preventive WOs
- Create both reactive (Corrective) and scheduled (Preventive) work orders.
+ Task & Checklist Management
- Assign specific tasks (e.g., Inspection, Replacement) and create detailed checklists for each work order.
+ Assignment & Scheduling
- Assign work orders to specific users (Technicians, Engineers) and set start/due dates.
+ Calendar View
- Visualize all scheduled work orders on a monthly calendar, color-coded by priority and status.
+ Automated PM Generation
- Automatically create work orders based on pre-defined PM schedules (e.g., weekly, monthly).

User & Location Mgmt.
+ Role-Based Access Control
- A granular permission system controls user access to every feature (e.g., view, create, edit, delete).
+ User Management
- Admins can create, edit, and delete user accounts and assign roles (e.g., Admin, Manager, Technician).
+ Hierarchical Location Management
- Admins can define the physical and storage location hierarchy of the entire facility.

Administrative
+ Activity Log
- Records all significant user actions, providing a complete audit trail for accountability.
+ Feedback System
- Allows any user to send feedback, suggestions, or bug reports directly to the system administrator.

How It Operates
ManCIS is a classic client-server web application built with a focus on simplicity and maintainability.

1. Technical Architecture
Frontend: A single-page application (SPA) built with Vanilla JavaScript (ES6 Modules). It uses Tailwind CSS for styling, ensuring a modern and responsive user interface that works on both desktop and mobile devices. All user interactions are handled dynamically without requiring page reloads.

Backend: A PHP-based RESTful API serves as the backend. Each PHP file in the /backend directory corresponds to a specific API endpoint that handles one action (e.g., get_assets.php, create_work_order.php). It connects to the database, enforces business logic, and handles user authentication and authorization.

Database: A MySQL database (mancis_db) stores all application data. It uses relational tables to link assets, work orders, parts, users, and locations together.

2. Core Workflows
Work Order Lifecycle
Creation: A work order can be created in two ways:

Manually by a user (e.g., a Technician creates a "Corrective Maintenance" WO for a broken machine).

Automatically by the system based on a "Preventive Maintenance" schedule (e.g., a "Weekly Lubrication" WO is generated every Monday).

Assignment: The work order is assigned to a user and given a due date.

Execution: The assigned user performs the tasks, follows the checklist, and consumes any required spare parts from inventory.

Completion: The user marks the work order as "Completed," which deducts the consumed parts from the inventory database and updates the asset's maintenance history.

Inventory Management Workflow
Request: A user can request a new part (for purchase) or an existing part from storage. The system also automatically creates purchase requests for parts that fall below their minimum stock level.

Approval: A Manager or Supervisor reviews the request and either "Approves" or "Rejects" it.

Receiving: Once the ordered parts arrive, a user with "Restock" permissions marks the corresponding request as "Received." This moves the items into a temporary holding state.

Restocking: The user then officially restocks the received items into a specific storage location (e.g., Cabinet > Shelf > Box), which updates the final quantity in the parts table.

3. User Permissions
Access to every part of the application is controlled by a powerful role-based permission system. An Admin has full control and can customize the default permissions for every other role (Manager, Supervisor, Engineer, Technician, Clerk). This ensures that users can only see and interact with the data and functions relevant to their job.

Getting Started (Developer Setup)
Web Server: Set up a local web server environment like XAMPP or WAMP. Place the entire project folder in the server's root directory (e.g., htdocs).

Database: Create a new MySQL database named mancis_db. Import the provided .sql file to create all the necessary tables.

Configuration:

In backend/, update the database connection details ($servername, $username, $password) in all PHP files if they differ from the default.

In js/config.js, update the API_URL constant to point to your local backend folder (e.g., http://localhost/mancis-cmms/backend).

Admin User: Use the backend/hash_generator.php script to create a secure password hash for your first admin user. Manually insert this user into the users table in your database with the role set to 'Admin'.

Access: Navigate to the project URL in your web browser (e.g., http://localhost/mancis-cmms/) to access the login screen.