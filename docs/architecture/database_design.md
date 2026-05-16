# Database Design (3rd Normal Form)

This document outlines the database schema for Pixigen, designed for scalability, multi-tenancy, and 3NF compliance.

## ER Diagram (Mermaid)

```mermaid
erDiagram
    USERS ||--o{ API_KEYS : has
    USERS ||--o{ PROJECTS : owns
    USERS ||--o{ ASSETS : owns
    USERS ||--o{ STORAGE_JOBS : triggers

    ORGANIZATIONS ||--o{ USERS : contains
    ORGANIZATIONS ||--o{ API_KEYS : has
    ORGANIZATIONS ||--o{ PROJECTS : owns

    PROJECTS ||--o{ PROJECT_ASSETS : contains
    ASSETS ||--o{ PROJECT_ASSETS : used_in

    PROJECTS {
        uuid id PK
        uuid user_id FK
        uuid org_id FK
        text name
        jsonb canvas_data
        timestamp created_at
        timestamp updated_at
    }

    ASSETS {
        uuid id PK
        uuid user_id FK
        uuid org_id FK
        text name
        text type
        text category
        text url
        bigint file_size
        boolean is_public
        timestamp created_at
    }

    PROJECT_ASSETS {
        uuid project_id PK, FK
        uuid asset_id PK, FK
    }

    API_KEYS {
        uuid id PK
        uuid user_id FK
        uuid org_id FK
        text key_hash
        text name
        text scopes
        timestamp last_used_at
        timestamp created_at
    }

    STORAGE_JOBS {
        uuid id PK
        uuid user_id FK
        text status
        jsonb payload
        text result_url
        text error
        timestamp created_at
        timestamp started_at
        timestamp finished_at
    }
```

## Normalization (3NF) Analysis

1.  **1NF (First Normal Form)**:
    - All tables have a primary key (`id`).
    - Values are atomic (e.g., `canvas_data` is a single JSONB block, but could be further broken down if we filtered by elements; for now, it's the atomic state of a project).
2.  **2NF (Second Normal Form)**:
    - All non-key attributes are fully functional dependent on the primary key.
    - Moved many-to-many relationships (projects to assets) into a junction table `PROJECT_ASSETS`.
3.  **3NF (Third Normal Form)**:
    - No transitive dependencies.
    - `ORGANIZATIONS` handles multi-tenancy separately from `USERS`, avoiding duplication of org details in the user profile.

## Key Tables

- **`api_keys`**: Essential for selling the service. This allows programmatic access.
- **`storage_jobs`**: Supports the background queue system by tracking the lifecycle of media processing.
- **`project_assets`**: Decouples assets from projects, allowing the same asset (e.g., a logo) to be used across multiple projects without duplication.
