package com.projectcrossplay.demo

import android.app.Activity
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * CrossPlay demo shop (B-034) — native Kotlin twin of examples/demo-web:
 * login → inventory list → item detail, same testIds (as resource-ids), same
 * credentials (demo / crossplay), and the same deliberate asynchrony: a
 * ~400 ms login spinner and list rows appearing with an 80 ms stagger, so a
 * suite without auto-waiting flakes here exactly like on web (FR-040).
 */
class MainActivity : Activity() {

    data class Item(val id: Int, val name: String, val price: String, val blurb: String)

    private val items = listOf(
        Item(1, "Trace Recorder", "$29", "Every step, every screenshot, one portable file."),
        Item(2, "Auto Waiter", "$49", "Present, visible, stable, enabled — then act."),
        Item(3, "Selector Unifier", "$19", "One testId for web and Android."),
        Item(4, "Flake Eliminator", "$99", "0 failures in 50 runs, or your money back."),
        Item(5, "Doctor Kit", "$9", "Diagnoses your environment in seconds."),
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showLogin(null)
    }

    private fun screen(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        val pad = (16 * resources.displayMetrics.density).toInt()
        setPadding(pad, pad, pad, pad)
    }

    private fun heading(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 24f
        setTypeface(typeface, Typeface.BOLD)
    }

    private fun showLogin(error: String?) {
        val root = screen()
        root.addView(heading("Demo Shop"))
        root.addView(TextView(this).apply {
            id = R.id.login_hint
            text = "Sign in with demo / crossplay"
        })
        val username = EditText(this).apply {
            id = R.id.username
            hint = "Username"
            inputType = InputType.TYPE_CLASS_TEXT
        }
        val password = EditText(this).apply {
            id = R.id.password
            hint = "Password"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        root.addView(username)
        root.addView(password)
        root.addView(Button(this).apply {
            id = R.id.login_button
            text = "Sign in"
            isAllCaps = false
            setOnClickListener {
                val user = username.text.toString()
                val pass = password.text.toString()
                showSpinner()
                // Post on the decor view: it stays attached across
                // setContentView, so the delayed transition always fires.
                window.decorView.postDelayed({
                    if (user == "demo" && pass == "crossplay") showList()
                    else showLogin("Wrong username or password")
                }, 400)
            }
        })
        if (error != null) {
            root.addView(TextView(this).apply {
                id = R.id.login_error
                text = error
                setTextColor(0xFFC0392B.toInt())
            })
        }
        setContentView(root)
    }

    private fun showSpinner() {
        setContentView(screen().apply {
            gravity = Gravity.CENTER
            addView(TextView(this@MainActivity).apply {
                id = R.id.spinner
                text = "Signing in…"
                alpha = 0.6f
            })
        })
    }

    private fun showList() {
        val root = screen()
        root.addView(heading("Inventory"))
        root.addView(TextView(this).apply {
            id = R.id.greeting
            text = "Welcome back, demo"
        })
        val list = LinearLayout(this).apply {
            id = R.id.item_list
            orientation = LinearLayout.VERTICAL
        }
        root.addView(ScrollView(this).apply {
            addView(list)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f,
            )
        })
        root.addView(Button(this).apply {
            id = R.id.logout_button
            text = "Log out"
            isAllCaps = false
            setOnClickListener { showLogin(null) }
        })
        setContentView(root)

        // Rows appear one by one — exercises present/stable waiting on the last row.
        val rowIds = intArrayOf(0, R.id.item_row_1, R.id.item_row_2, R.id.item_row_3, R.id.item_row_4, R.id.item_row_5)
        items.forEachIndexed { idx, item ->
            window.decorView.postDelayed({
                list.addView(TextView(this).apply {
                    id = rowIds[item.id]
                    text = "${item.name} — ${item.price}"
                    textSize = 16f
                    val pad = (12 * resources.displayMetrics.density).toInt()
                    setPadding(pad, pad, pad, pad)
                    isClickable = true
                    setOnClickListener { showDetail(item) }
                })
            }, 80L * (idx + 1))
        }
    }

    private fun showDetail(item: Item) {
        val root = screen()
        root.addView(heading(item.name).apply { id = R.id.detail_title })
        root.addView(TextView(this).apply {
            id = R.id.detail_price
            text = item.price
        })
        root.addView(TextView(this).apply {
            id = R.id.detail_blurb
            text = item.blurb
        })
        root.addView(Button(this).apply {
            id = R.id.back_button
            text = "Back to list"
            isAllCaps = false
            setOnClickListener { showList() }
        })
        setContentView(root)
    }
}
