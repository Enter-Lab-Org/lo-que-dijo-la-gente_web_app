// A board tile. Text and points exist in the DOM only while the answer is revealed.
export default function AnswerTile({ index, open }) {
  return (
    <li className="s-tile">
      <div className={"s-slot" + (open ? " open" : "")} data-i={index}>
        <div className="s-card">
          <div className="s-front"><span className="s-num">{index + 1}</span></div>
          <div className="s-back"><span className="s-ans">{open ? open.text : ""}</span><span className="s-pts">{open ? open.pts : ""}</span></div>
        </div>
      </div>
    </li>
  );
}

export const BlankTile = () => <li className="s-tile pad"><div className="s-blank" /></li>;
