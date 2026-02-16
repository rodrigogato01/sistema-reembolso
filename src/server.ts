<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pagamento PIX</title>

<style>
body{font-family:Arial;background:#f4f4f4;text-align:center;padding:40px}
.box{background:#fff;padding:20px;border-radius:10px;max-width:400px;margin:auto}
button{background:#00a650;color:#fff;border:none;padding:15px;width:100%;border-radius:8px;font-size:16px;margin-top:15px}
#continuar{display:none;background:#007bff}
#pixCode{word-break:break-all;background:#eee;padding:10px;margin-top:10px;border-radius:8px;font-size:12px}
</style>
</head>

<body>

<div class="box">

<h2>Pagamento via PIX</h2>

<button onclick="gerarPix()" id="btnPix">Gerar QR Code</button>

<div id="qrcode"></div>
<div id="pixCode"></div>

<button id="continuar" onclick="continuar()">Continuar</button>

</div>

<script>

let transactionId = null

async function gerarPix(){

  document.getElementById("btnPix").disabled = true

  const req = await fetch("/pix",{method:"POST"})
  const res = await req.json()

  transactionId = res.transactionId

  if(res.encodedImage){
    document.getElementById("qrcode").innerHTML =
      `<img src="data:image/png;base64,${res.encodedImage}" width="220">`
  }

  document.getElementById("pixCode").innerText = res.payload

  consultarStatus()
}

function consultarStatus(){

  const intervalo = setInterval(async()=>{

    const req = await fetch(`/check-status/${transactionId}`)
    const res = await req.json()

    if(res.paid){

      clearInterval(intervalo)

      document.getElementById("qrcode").innerHTML = ""
      document.getElementById("pixCode").innerHTML = "✅ PAGAMENTO CONFIRMADO"

      document.getElementById("continuar").style.display = "block"

    }

  },3000)
}

function continuar(){
  window.location.href="https://recuperabonushopp.com/elementor-1064"
}

</script>

</body>
</html>
