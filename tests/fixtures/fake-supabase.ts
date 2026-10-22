// A tiny in-memory stand-in for the parts of the Supabase query builder the
// tracker modules use. Projections are ignored (full rows come back).
type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

export function fakeSupabase(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = Object.fromEntries(
    Object.entries(seed).map(([name, rows]) => [name, rows.map((r) => ({ ...r }))]),
  );
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  const table = (name: string) => (tables[name] ??= []);

  function query(name: string) {
    const filters: Filter[] = [];
    let op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    let payload: Row | Row[] | undefined;
    let head = false;
    let count = false;
    let limit = Infinity;
    let order: { column: string; ascending: boolean }[] = [];

    function run() {
      calls.push({ table: name, op, payload });
      const rows = table(name);
      if (op === "insert" || op === "upsert") {
        const list = (Array.isArray(payload) ? payload : [payload!]).map((r) => ({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...r,
        }));
        rows.push(...list);
        return { data: list, error: null };
      }
      const matched = rows.filter((row) => filters.every((f) => f(row)));
      if (op === "update") {
        for (const row of matched) Object.assign(row, payload);
        return { data: matched, error: null };
      }
      if (op === "delete") {
        tables[name] = rows.filter((row) => !matched.includes(row));
        return { data: matched, error: null };
      }
      let out = [...matched];
      for (const o of [...order].reverse())
        out.sort((a, b) => String(a[o.column] ?? "").localeCompare(String(b[o.column] ?? "")) * (o.ascending ? 1 : -1));
      out = out.slice(0, limit);
      return { data: head ? null : out, error: null, count: count ? matched.length : null };
    }

    const builder = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        head = Boolean(opts?.head);
        count = Boolean(opts?.count);
        return builder;
      },
      insert(rows: Row | Row[]) {
        op = "insert";
        payload = rows;
        return builder;
      },
      upsert(rows: Row | Row[]) {
        op = "upsert";
        payload = rows;
        return builder;
      },
      update(patch: Row) {
        op = "update";
        payload = patch;
        return builder;
      },
      delete() {
        op = "delete";
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return builder;
      },
      in(column: string, values: unknown[]) {
        filters.push((row) => values.includes(row[column]));
        return builder;
      },
      is(column: string, value: unknown) {
        filters.push((row) => (row[column] ?? null) === value);
        return builder;
      },
      not(column: string, _op: string, value: unknown) {
        filters.push((row) => (row[column] ?? null) !== value);
        return builder;
      },
      gte(column: string, value: string) {
        filters.push((row) => String(row[column]) >= value);
        return builder;
      },
      match(obj: Row) {
        for (const [k, v] of Object.entries(obj)) builder.eq(k, v);
        return builder;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        order.push({ column, ascending: opts?.ascending !== false });
        return builder;
      },
      limit(n: number) {
        limit = n;
        return builder;
      },
      async maybeSingle() {
        const result = run();
        const list = (result.data ?? []) as Row[];
        return { data: list[0] ?? null, error: null };
      },
      async single() {
        const result = run();
        const list = (result.data ?? []) as Row[];
        return list[0] ? { data: list[0], error: null } : { data: null, error: { message: "no rows" } };
      },
      then(resolve: (value: ReturnType<typeof run>) => unknown, reject?: (e: unknown) => unknown) {
        try {
          return Promise.resolve(resolve(run()));
        } catch (e) {
          return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
        }
      },
    };
    order = [];
    return builder;
  }

  const client = {
    from: (name: string) => query(name),
    rpc: async () => ({ data: null, error: null }),
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "https://storage.test/signed" }, error: null }),
        createSignedUploadUrl: async () => ({ data: { signedUrl: "/upload/signed" }, error: null }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
  };
  return { client, tables, calls };
}
