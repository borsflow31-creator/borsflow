'use client'

import React, { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

/* The opening sequence.
 *
 * Two rules govern this file and neither is negotiable:
 *
 * 1. Everything animates with gsap.from(), never gsap.to() out of a hidden
 *    CSS state. from() reads the DOM's own resting state and animates toward
 *    it, so if this bundle never loads, never hydrates, or throws, the hero
 *    renders complete. A hero that depends on JavaScript to become visible is
 *    the same failure as a colour field that depends on a scroll listener.
 *
 * 2. The capture is the LCP element and must never animate opacity. Fading
 *    the largest contentful paint defers the metric by the length of the
 *    tween. It gets a clip-path wipe instead, which leaves it painted from
 *    the first frame.
 */
export const HeroStage = ({ children }: { children: React.ReactNode }) => {
    const root = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        const ctx = gsap.context((self) => {
            const mm = gsap.matchMedia()

            mm.add('(prefers-reduced-motion: no-preference)', () => {
                const ease = CustomEase.create('obsidian', '0.16, 1, 0.3, 1')
                const q = self.selector as (s: string) => Element[]

                const tl = gsap.timeline({ defaults: { ease, duration: 0.7 } })

                tl.from(q('[data-hero="line"]'), { yPercent: 108, stagger: 0.08 }, 0)
                    .from(q('[data-hero="lead"]'), { y: 14, opacity: 0, duration: 0.6 }, 0.26)
                    .from(q('[data-hero="action"]'), { y: 12, opacity: 0, stagger: 0.06, duration: 0.55 }, 0.36)
                    .from(q('[data-hero="assurance"]'), { y: 8, opacity: 0, stagger: 0.05, duration: 0.5 }, 0.46)
                    // Opacity is deliberately absent here. See note 2 above.
                    .from(
                        q('[data-hero="plate"]'),
                        { clipPath: 'inset(0% 0% 100% 0%)', y: 10, duration: 0.9 },
                        0.15
                    )

                return () => tl.kill()
            })

            return () => mm.revert()
        }, root)

        return () => ctx.revert()
    }, [])

    return (
        <div ref={root}>
            {children}
        </div>
    )
}
