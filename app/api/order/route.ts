import { NextResponse } from "next/server";

import { db } from "@/lib/firebase";

import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "firebase/firestore";



export async function POST(request: Request) {


  try {


    const body = await request.json();



    const {
      name,
      phone,
      district,
      address,
      product,
      color,
      quantity
    } = body;







    // SAVE ORDER TO FIREBASE


    await addDoc(

      collection(db,"orders"),

      {


        name,

        phone,

        district,

        address,

        product,

        color,

        quantity,


        status:"Pending",


        createdAt:serverTimestamp()


      }

    );









    // GET TELEGRAM SETTINGS FROM FIREBASE


    const telegramSnap = await getDoc(

      doc(
        db,
        "settings",
        "telegram"
      )

    );






    if(!telegramSnap.exists()){


      return NextResponse.json({

        success:false,

        message:"Telegram settings not configured"

      });


    }







    const telegramData = telegramSnap.data();



    const botToken = telegramData.botToken;


    const chatId = telegramData.chatId;







    const message = `

🛍️ NEW AVEN ORDER


━━━━━━━━━━━━━━

📦 Product:
${product}


🎨 Color:
${color}


🔢 Quantity:
${quantity}


━━━━━━━━━━━━━━


👤 Customer:
${name}


📱 Phone:
${phone}


📍 District:
${district}


🏠 Address:
${address}


━━━━━━━━━━━━━━

⏳ Status:
Pending

`;









    const telegramUrl =

    `https://api.telegram.org/bot${botToken}/sendMessage`;









    const telegramResponse = await fetch(

      telegramUrl,

      {


        method:"POST",


        headers:{


          "Content-Type":"application/json"


        },


        body:JSON.stringify({


          chat_id:chatId,


          text:message


        })


      }

    );







    if(!telegramResponse.ok){


      console.log(
        "Telegram send failed"
      );


    }









    return NextResponse.json({


      success:true,


      message:"Order saved and telegram sent"



    });









  }

  catch(error){



    console.log(
      "ORDER ERROR:",
      error
    );



    return NextResponse.json(


      {


        success:false,


        message:"Something went wrong"


      },


      {


        status:500


      }


    );


  }



}