param(
  [Parameter(Mandatory = $true)][string]$InputDocx
)

$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open($InputDocx, $false, $false)
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
  foreach ($story in $doc.StoryRanges) {
    $range = $story
    while ($null -ne $range) {
      if ($range.Fields.Count -gt 0) { [void]$range.Fields.Update() }
      $range = $range.NextStoryRange
    }
  }
  $doc.Save()
}
finally {
  if ($null -ne $doc) { $doc.Close($false) }
  if ($null -ne $word) { $word.Quit() }
  if ($null -ne $doc) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($doc) }
  if ($null -ne $word) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
