// Minimal Postgres.js tagged-template adapter, including safely quoted identifiers.
// Query values remain parameters; never interpolate them into the SQL text.
export function pgliteSql(db) {
  const identifier = Symbol('identifier');
  const sql = (strings, ...values) => {
    if (typeof strings === 'string') return { [identifier]: true, name: strings };
    const params = [];
    const query = strings.reduce((text, part, index) => {
      text += part;
      if (index >= values.length) return text;
      const value = values[index];
      if (value?.[identifier]) return text + '"' + value.name.replaceAll('"', '""') + '"';
      params.push(value);
      return text + `$${params.length}`;
    }, '');
    return db.query(query, params).then(result => result.rows);
  };
  return sql;
}
