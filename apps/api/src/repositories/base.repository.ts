// ============================================================
// RetailNexus — Base Repository (Generic Cosmos DB CRUD)
// ============================================================

import { Container, SqlQuerySpec, FeedResponse } from "@azure/cosmos";
import { generateId, now } from "@retailnexus/shared";
import type { PaginatedResult, PaginationParams } from "@retailnexus/shared";

export class BaseRepository<T extends { id: string }> {
  constructor(
    protected getContainer: () => Container,
    protected partitionKeyField: keyof T
  ) {}

  /**
   * Create a new document.
   */
  async create(item: T): Promise<T> {
    const doc = {
      ...item,
      id: item.id || generateId(),
      createdAt: now(),
      updatedAt: now(),
    };
    const { resource } = await this.getContainer().items.create(doc);
    return resource as T;
  }

  /**
   * Read a single document by id and partition key.
   */
  async getById(id: string, partitionKeyValue: string): Promise<T | null> {
    try {
      const { resource } = await this.getContainer()
        .item(id, partitionKeyValue)
        .read<T>();
      return resource ?? null;
    } catch (err: unknown) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /**
   * Update a document (partial update via replace).
   */
  async update(
    id: string,
    partitionKeyValue: string,
    updates: Partial<T>
  ): Promise<T | null> {
    const existing = await this.getById(id, partitionKeyValue);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Never overwrite id
      updatedAt: now(),
    };

    const { resource } = await this.getContainer()
      .item(id, partitionKeyValue)
      .replace(updated);
    return resource as T;
  }

  /**
   * Delete a document.
   */
  async delete(id: string, partitionKeyValue: string): Promise<boolean> {
    try {
      await this.getContainer().item(id, partitionKeyValue).delete();
      return true;
    } catch (err: unknown) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }

  /**
   * Query documents with SQL.
   */
  async query(querySpec: SqlQuerySpec): Promise<T[]> {
    const { resources } = await this.getContainer()
      .items.query<T>(querySpec)
      .fetchAll();
    return resources;
  }

  /**
   * Query with pagination.
   */
  async queryPaginated(
    querySpec: SqlQuerySpec,
    params: PaginationParams = {}
  ): Promise<PaginatedResult<T>> {
    const { page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    // Count query
    const countQuery: SqlQuerySpec = {
      query: `SELECT VALUE COUNT(1) FROM c WHERE ${extractWhereClause(querySpec.query)}`,
      parameters: querySpec.parameters,
    };

    let total = 0;
    try {
      const { resources: countResult } = await this.getContainer()
        .items.query<number>(countQuery)
        .fetchAll();
      total = countResult[0] || 0;
    } catch {
      // Fallback: run full query
      total = 0;
    }

    // Paginated query
    const paginatedQuery: SqlQuerySpec = {
      query: `${querySpec.query} OFFSET @offset LIMIT @limit`,
      parameters: [
        ...(querySpec.parameters || []),
        { name: "@offset", value: offset },
        { name: "@limit", value: pageSize },
      ],
    };

    const { resources: items } = await this.getContainer()
      .items.query<T>(paginatedQuery)
      .fetchAll();

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: offset + items.length < total,
    };
  }

  /**
   * List all documents for a given partition key value.
   */
  async listByPartition(
    partitionKeyValue: string,
    params: PaginationParams = {}
  ): Promise<PaginatedResult<T>> {
    const field = String(this.partitionKeyField);
    const querySpec: SqlQuerySpec = {
      query: `SELECT * FROM c WHERE c.${field} = @pkValue ORDER BY c.createdAt DESC`,
      parameters: [{ name: "@pkValue", value: partitionKeyValue }],
    };
    return this.queryPaginated(querySpec, params);
  }
}

// ─── Helpers ───

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 404
  );
}

function extractWhereClause(query: string): string {
  const match = query.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+OFFSET|\s*$)/i);
  return match ? match[1] : "1=1";
}
