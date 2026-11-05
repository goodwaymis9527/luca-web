import { listItems } from '../lib/db.js';

// serverless 上不要用靜態快取，否則第一次 build 的結果會被固定在 edge
export const dynamic = 'force-dynamic';

export default async function Page() {
  const items = await listItems(50);

  return (
    <main>
      <h1>Hello World（動態版）</h1>
      <p>資料來自 PostgreSQL <code>items</code> 表</p>

      <table>
        <tr>
          <th>#</th>
          <th>標題</th>
          <th>內文</th>
          <th>建立時間</th>
        </tr>
        {items.length === 0 && (
          <tr>
            <td colSpan="4">還沒有資料，下方表单新增一筆</td>
          </tr>
        )}
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.title}</td>
            <td>{item.body}</td>
            <td>{new Date(item.created_at).toISOString()}</td>
          </tr>
        ))}
      </table>

      {/* 純表單 POST，不需要 client JS；route handler 處理完會 redirect 回本页 */}
      <form method="post" action="/api/items">
        <input name="title" placeholder="標題" required maxLength="120" />
        {/* route handler 已支援 form 的 body 欄位，之前表單沒送出所以內文永遠是空字串 */}
        <textarea name="body" placeholder="內文" rows="4" maxLength="2000"></textarea>
        <button type="submit">新增</button>
      </form>
    </main>
  );
}
