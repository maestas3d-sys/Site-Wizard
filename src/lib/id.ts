/** Client-generated uuid, used as the primary key for every record. */
export function newId(): string {
  return crypto.randomUUID()
}
