<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pagamento PIX</title>

<style>
body{
  font-family: Arial, Helvetica, sans-serif;
  background:#f5f5f5;
  display:flex;
  justify-content:center;
  align-items:center;
  height:100vh;
}

.box{
  background:#fff;
  padding:30px;
  border-radius:12px;
  text-align:center;
  width:350px;
  box-shadow:0 0 15px rgba(0,0,0,0.1);
}

button{
  background:#00a650;
  color:#fff;
  border:none;
  padding:15px;
  width:100%;
  font-size:16px;
  border-radius:8px;
  cursor:pointer;
  margin-top:15px;
}

button:disabled{
  background:gray;
}

#qrcode{
  margin-top:20px;
}

#pixCode{
  word-break:break-all;
  background:#f1f1f1;
  padding:10px;
  border-radius:8px;
  margin-top:10px;
  font-size:12px;
}

#continuar{
  display:none;
  background:#007bff;
}
</style>
</head>

<body>

<div class="box">

<h2>Pagamento via PIX</h2>

<button onclick="gerarPix()" id="gerar">
Gerar QR Code
</button>

<div id="qrcode"></div>

<div id="pixCode"></div>

<button id="continuar" onclick="continuar()">
Continuar
</button>

</div>

<script>

let transactionId = null

async function gerarPix(){

  document.getElementById("gerar").disabled = true

  const res = await fetch("/pix", { method:"POST" })
  const data = await res.json()

  transactionId = data.transactionId

  if(data.encodedImage){
    document.getElementById("qrcode").innerHTML =
      `<img src="data:image/png;base64,${data.encodedImage}" width="220">`
  }

  document.getElementById("pixCode").innerText = data.payload

  verificarPagamento()
}

async function verificarPagamento(){

  const interval = setInterval(async () => {

    const res = await fetch(`/check-status/${transactionId}`)
    const data = await res.json()

    if(data.paid){

      clearInterval(interval)

      document.getElementById("qrcode").innerHTML = ""
      document.getElementById("pixCode").innerHTML = "✅ PAGAMENTO CONFIRMADO"

      document.getElementById("continuar").style.display = "block"

    }

  }, 3000)

}

function continuar(){
  window.location.href = "https://recuperabonushopp.com/elementor-1064"
}

</script>

</body>
</html>
