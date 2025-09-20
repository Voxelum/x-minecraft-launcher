# Infra Folder

This folder contains infrastructure-level code that is not directly related to business logic. It includes utilities, services, and components that support the overall application architecture, such as networking, data persistence, authentication, and other foundational services.

## Modules

- **client_token.ts**: Manages client session tokens for identifying user sessions.
- **flights.ts**: Handles feature flags and experimental features fetched from remote servers.
- **gfw.ts**: Detects the network environment, such as whether the client is behind the Great Firewall of China.
- **image_store.ts**: Provides image storage, caching, and retrieval utilities.
- **logger.ts**: Defines the logging interface and utilities for application logging.
- **log_consumer.ts**: Handles log consumption, formatting, and storage to files.
- **ssh.ts**: Manages SSH connections and SFTP operations.
- **task.ts**: Provides task execution, management, and event handling for asynchronous operations.
- **telemetry.ts**: Implements application telemetry for tracking usage and errors.
- **telemetry_resource.ts**: Handles telemetry specifically for resource-related data.
- **uncaught_error.ts**: Catches and logs uncaught exceptions and unhandled rejections.
- **zip_manager.ts**: Manages zip file operations, including opening and caching zip files.
- **errors/**: Contains utilities for error diagnosis, decoration, and stack trace parsing.
