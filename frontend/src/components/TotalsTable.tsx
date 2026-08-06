import { TotalsRow } from "../lib/types";

interface Props {
  rows: TotalsRow[];
}

export function TotalsTable({ rows }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Language</th>
            <th>Number Posts</th>
            <th>Likes</th>
            <th>Comments</th>
            <th>Shares</th>
            <th>Total Engagements</th>
            <th>Number of Videos</th>
            <th>Total Views</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.language} className={row.language === "TOTAL" ? "totals-row" : undefined}>
              <td>{row.language}</td>
              <td>{row.numberPosts}</td>
              <td>{row.likes}</td>
              <td>{row.comments}</td>
              <td>{row.shares}</td>
              <td>{row.totalEngagements}</td>
              <td>{row.numberOfVideos}</td>
              <td>{row.totalViews}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
