const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/influencers/page.tsx', 'utf8');

code = code.replace(
  "onClick={() => handleToggleSave(inf)}",
  "onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleSave(inf); }}"
);
code = code.replace(
  "onClick={() => handleToggleSave(inf)}",
  "onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleSave(inf); }}"
);

fs.writeFileSync('src/app/dashboard/influencers/page.tsx', code);
