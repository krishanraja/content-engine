# The one open pull request auto-merge may merge for a green CI run: not a draft, at the run's exact commit, from a
# branch of this repository (never a fork), by Krish or the Actions bot. Same rule as control-center's (#804).
def allowed_author: (.author.login // "") as $a
  | ($a == "krishanraja" or $a == "github-actions" or $a == "app/github-actions" or $a == "github-actions[bot]");
[ .[]
  | select(.isDraft | not)
  | select(.headRefOid == $sha)
  | select(.isCrossRepository == false)
  | select((.headRepositoryOwner.login // "") == $owner)
  | select(allowed_author)
][0].number // empty
