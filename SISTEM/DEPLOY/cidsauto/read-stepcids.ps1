$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open("C:\Users\Akmal Nasir\Desktop\SISTEM DEPLOY\cidsauto\STEP CIDS.docx")
$text = $doc.Content.Text
Write-Output $text
$doc.Close(0)
$word.Quit()
